'use strict';

const ErrorCode = Object.freeze({
  UNAUTHORIZED:     'UNAUTHORIZED',
  FORBIDDEN:        'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND:        'NOT_FOUND',
  DATABASE_ERROR:   'DATABASE_ERROR',
  INTERNAL_ERROR:   'INTERNAL_ERROR',
});

const HTTP_STATUS = Object.freeze({
  [ErrorCode.UNAUTHORIZED]:     401,
  [ErrorCode.FORBIDDEN]:        403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]:        404,
  [ErrorCode.DATABASE_ERROR]:   500,
  [ErrorCode.INTERNAL_ERROR]:   500,
});

module.exports = { ErrorCode, HTTP_STATUS };
