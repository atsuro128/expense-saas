// error-messages.ts のユニットテスト。
// inferCodeFromStatus 関数の各 HTTP ステータスコード → エラーコードのマッピングを検証する。
// SERVER_ERROR_MESSAGES の定義確認も含む。

import { describe, it, expect } from 'vitest';
import { inferCodeFromStatus, SERVER_ERROR_MESSAGES } from '../error-messages';

describe('inferCodeFromStatus', () => {
  // EMG-001: 500 → INTERNAL_ERROR
  it('EMG-001: 500 は INTERNAL_ERROR を返す', () => {
    expect(inferCodeFromStatus(500)).toBe('INTERNAL_ERROR');
  });

  // EMG-002: 502 → INTERNAL_ERROR
  it('EMG-002: 502 は INTERNAL_ERROR を返す', () => {
    expect(inferCodeFromStatus(502)).toBe('INTERNAL_ERROR');
  });

  // EMG-003: 503 → INTERNAL_ERROR
  it('EMG-003: 503 は INTERNAL_ERROR を返す', () => {
    expect(inferCodeFromStatus(503)).toBe('INTERNAL_ERROR');
  });

  // EMG-004: 504 → INTERNAL_ERROR
  it('EMG-004: 504 は INTERNAL_ERROR を返す', () => {
    expect(inferCodeFromStatus(504)).toBe('INTERNAL_ERROR');
  });

  // EMG-005: 429 → RATE_LIMIT_EXCEEDED
  it('EMG-005: 429 は RATE_LIMIT_EXCEEDED を返す', () => {
    expect(inferCodeFromStatus(429)).toBe('RATE_LIMIT_EXCEEDED');
  });

  // EMG-006: 404 → RESOURCE_NOT_FOUND
  it('EMG-006: 404 は RESOURCE_NOT_FOUND を返す', () => {
    expect(inferCodeFromStatus(404)).toBe('RESOURCE_NOT_FOUND');
  });

  // EMG-007: 403 → FORBIDDEN
  it('EMG-007: 403 は FORBIDDEN を返す', () => {
    expect(inferCodeFromStatus(403)).toBe('FORBIDDEN');
  });

  // EMG-008: 409 → CONFLICT
  it('EMG-008: 409 は CONFLICT を返す', () => {
    expect(inferCodeFromStatus(409)).toBe('CONFLICT');
  });

  // EMG-009: 422 → VALIDATION_ERROR
  it('EMG-009: 422 は VALIDATION_ERROR を返す', () => {
    expect(inferCodeFromStatus(422)).toBe('VALIDATION_ERROR');
  });

  // EMG-010: 想定外ステータス（例: 418）→ INTERNAL_ERROR にフォールバック
  it('EMG-010: 想定外のステータスコード（418）は INTERNAL_ERROR を返す', () => {
    expect(inferCodeFromStatus(418)).toBe('INTERNAL_ERROR');
  });

  // EMG-011: 400 は想定外扱いのため INTERNAL_ERROR を返す
  it('EMG-011: 400 は INTERNAL_ERROR を返す（inferCodeFromStatus は JSON パース失敗時のみ使用するため）', () => {
    expect(inferCodeFromStatus(400)).toBe('INTERNAL_ERROR');
  });
});

describe('SERVER_ERROR_MESSAGES', () => {
  // EMG-020: INTERNAL_ERROR の文言が設計書通りであること
  it('EMG-020: INTERNAL_ERROR は「サーバーとの通信に失敗しました。しばらくしてから再度お試しください。」', () => {
    expect(SERVER_ERROR_MESSAGES['INTERNAL_ERROR']).toBe(
      'サーバーとの通信に失敗しました。しばらくしてから再度お試しください。',
    );
  });

  // EMG-021: RATE_LIMIT_EXCEEDED の文言が設計書通りであること
  it('EMG-021: RATE_LIMIT_EXCEEDED は「しばらく待ってから再試行してください」', () => {
    expect(SERVER_ERROR_MESSAGES['RATE_LIMIT_EXCEEDED']).toBe(
      'しばらく待ってから再試行してください',
    );
  });

  // EMG-022: RESOURCE_NOT_FOUND の文言が設計書通りであること
  it('EMG-022: RESOURCE_NOT_FOUND は「指定されたデータが見つかりません。」', () => {
    expect(SERVER_ERROR_MESSAGES['RESOURCE_NOT_FOUND']).toBe(
      '指定されたデータが見つかりません。',
    );
  });

  // EMG-023: FORBIDDEN の文言が設計書通りであること
  it('EMG-023: FORBIDDEN は「この操作を行う権限がありません。」', () => {
    expect(SERVER_ERROR_MESSAGES['FORBIDDEN']).toBe(
      'この操作を行う権限がありません。',
    );
  });

  // EMG-024: CONFLICT の文言が設計書通りであること
  it('EMG-024: CONFLICT は「他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。」', () => {
    expect(SERVER_ERROR_MESSAGES['CONFLICT']).toBe(
      '他のユーザーがこのレポートを更新しました。ページを再読み込みしてください。',
    );
  });
});
