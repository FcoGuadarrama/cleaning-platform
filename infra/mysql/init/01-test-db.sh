#!/bin/sh
# Isolated test schema inside this worktree's container; the app user may create/drop it.
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS app_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON app_test.* TO '$MYSQL_USER'@'%';
SQL
