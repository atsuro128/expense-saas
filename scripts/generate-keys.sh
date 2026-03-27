#!/bin/bash
set -e

mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
echo "JWT keys generated in keys/"
