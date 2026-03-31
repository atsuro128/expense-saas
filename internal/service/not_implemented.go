package service

import "errors"

// ErrNotImplemented is returned by stub service methods that have not been implemented yet.
var ErrNotImplemented = errors.New("not implemented")
