export type PersistenceErrorCode =
  | 'corrupt_data'
  | 'unsupported_schema'
  | 'migration_failed'
  | 'not_found'
  | 'conflict'
  | 'immutable_record'
  | 'validation_failed'
  | 'storage_unavailable'
  | 'atomic_write_failed';

export class PersistenceError extends Error {
  constructor(
    public readonly code: PersistenceErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export class DomainOperationError extends Error {
  constructor(
    public readonly code: 'validation_failed' | 'not_found' | 'conflict' | 'immutable_record',
    message: string,
  ) {
    super(message);
    this.name = 'DomainOperationError';
  }
}