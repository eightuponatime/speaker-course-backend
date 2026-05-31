#!/bin/bash

curl -i -X POST http://localhost:8080/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"satanov201354@gmail.com","password":"12345678","full_name":"Maxim"}'
