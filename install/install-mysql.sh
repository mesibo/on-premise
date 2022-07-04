#!/bin/sh
#set -e
mkdir -p /etc/mesibo
mkdir -p /mesibo/bin
mkdir -p /mesibo/git
mkdir -p /mesibo/acme
mkdir -p /certs

yum update -y
yum install -yq git nginx bzip2 psmisc mysql-devel mysql-libs mysql-server

sed -c -i "s/\SELINUX=.*/SELINUX=disabled/" /etc/sysconfig/selinux

echo "starting mysql"
systemctl start mysqld
#set GLOBAL validate_password.policy = low;
#set GLOBAL validate_password.length = 0;

# Disable Password policies - mysql_secure_installation will again enable it
mysql -e "uninstall plugin validate_password"
mysql -e "UNINSTALL COMPONENT 'file://component_validate_password'"

mysql -u root << EOF
set PASSWORD FOR root@localhost = 'mesibo';
create database IF NOT EXISTS mesibo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
create user if not exists 'mesibo'@'127.0.0.1' identified by 'mesibo';
grant all on mesibo.* to 'mesibo'@'127.0.0.1';
create user if not exists 'mesibo'@'localhost' identified by 'mesibo';
grant all on mesibo.* to 'mesibo'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "mysql securing installation..."

mysql_secure_installation -u root --password=mesibo -D

if ! grep -q mesibo /etc/my.cnf.d/mysql-server.cnf; then
cat >> /etc/my.cnf.d/mysql-server.cnf << EOF

# mesibo on-premise mysql configuration start
max_connections = 4096
local_infile=1
sql_mode = "STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION"
# mesibo on-premise mysql configuration end

EOF
fi

systemctl enable mysqld
systemctl restart mysqld
