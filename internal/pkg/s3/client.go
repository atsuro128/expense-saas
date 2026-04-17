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
//   - S3_ENDPOINT: カスタムエンドポイント URL（省略時は AWS S3 を使用）。内部通信・アップロード用。
//   - S3_PUBLIC_ENDPOINT: 署名付き URL 生成に使うエンドポイント URL（省略時は S3_ENDPOINT にフォールバック）。
//     ローカル開発で MinIO をホストブラウザからアクセス可能なホスト名に切り替えるために使用。
//     本番環境（AWS S3）では未設定でよい（S3_ENDPOINT も未設定なら AWS デフォルトエンドポイントを使用）。
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

	// 通常クライアント用オプション（内部通信・アップロード）。
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

	// PresignClient 用オプション（署名付き URL 生成・公開アクセス用）。
	// S3_PUBLIC_ENDPOINT が設定されている場合はそのエンドポイントを使う。
	// 未設定の場合は S3_ENDPOINT にフォールバックし、さらに未設定なら AWS デフォルトを使用する。
	var presignOpts []func(*s3.Options)

	publicEndpoint := os.Getenv("S3_PUBLIC_ENDPOINT")
	if publicEndpoint == "" {
		// フォールバック: S3_PUBLIC_ENDPOINT が未設定の場合は S3_ENDPOINT を使う（従来挙動）。
		publicEndpoint = endpoint
	}
	if publicEndpoint != "" {
		presignOpts = append(presignOpts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(publicEndpoint)
			o.UsePathStyle = true // MinIO はパス形式を使用する。
		})
	}

	presigner := s3.NewPresignClient(s3.NewFromConfig(cfg, presignOpts...))

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

// PresignGetObject は署名付き URL を生成する。
// disposition は ResponseContentDisposition に設定する値（service 層で組み立てた
// "attachment; filename=..." または "inline; filename=..." をそのまま渡す）。
func (c *Client) PresignGetObject(ctx context.Context, key, fileName, mimeType, disposition string, expiry time.Duration) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(expiry)

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
