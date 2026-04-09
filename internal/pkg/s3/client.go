package s3

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Client は AWS SDK v2 を使った S3/MinIO 互換ストレージクライアント。
// 本番環境では ECS タスクロール経由の認証、ローカルでは MinIO のスタティック認証を使う。
type Client struct {
	s3Client      *s3.Client
	presignClient *s3.PresignClient
	bucket        string
}

// NewClientFromEnv は環境変数から S3 クライアントを生成する。
// 環境変数:
//   - S3_ENDPOINT: カスタムエンドポイント URL（省略時は AWS S3 を使用）
//   - S3_BUCKET: バケット名
//   - AWS_ACCESS_KEY_ID: アクセスキー（省略時は ECS タスクロール等のデフォルトクレデンシャルを使用）
//   - AWS_SECRET_ACCESS_KEY: シークレットキー
//   - AWS_REGION: リージョン（省略時は ap-northeast-1）
func NewClientFromEnv() (*Client, error) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "ap-northeast-1"
	}

	var opts []func(*config.LoadOptions) error
	opts = append(opts, config.WithRegion(region))

	// スタティックキーが設定されていればスタティッククレデンシャルを使う（ローカル MinIO 用）。
	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	if accessKey != "" && secretKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		))
	}

	cfg, err := config.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("s3.NewClientFromEnv: load config: %w", err)
	}

	// S3 クライアントオプション。
	var s3Opts []func(*s3.Options)

	endpoint := os.Getenv("S3_ENDPOINT")
	if endpoint != "" {
		// MinIO 等のカスタムエンドポイント用設定。
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true // MinIO はパス形式を使用する。
		})
	}

	client := s3.NewFromConfig(cfg, s3Opts...)
	presigner := s3.NewPresignClient(client)

	return &Client{
		s3Client:      client,
		presignClient: presigner,
		bucket:        os.Getenv("S3_BUCKET"),
	}, nil
}

// Upload はオブジェクトを S3 にアップロードする。
func (c *Client) Upload(ctx context.Context, key string, data io.Reader, contentType string) error {
	_, err := c.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        data,
		ContentType: aws.String(contentType),
		ACL:         s3types.ObjectCannedACLPrivate,
	})
	if err != nil {
		return fmt.Errorf("s3.Upload: PutObject: %w", err)
	}
	return nil
}

// PresignGetObject は署名付きダウンロード URL を生成する。
// ResponseContentType を付与し、Content-Disposition で元ファイル名を返す。
func (c *Client) PresignGetObject(ctx context.Context, key, fileName, mimeType string, expiry time.Duration) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(expiry)

	disposition := fmt.Sprintf(`attachment; filename="%s"`, fileName)

	req, err := c.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(c.bucket),
		Key:                        aws.String(key),
		ResponseContentType:        aws.String(mimeType),
		ResponseContentDisposition: aws.String(disposition),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("s3.PresignGetObject: %w", err)
	}

	return req.URL, expiresAt, nil
}

// Delete はオブジェクトを S3 から削除する。
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("s3.Delete: DeleteObject: %w", err)
	}
	return nil
}
