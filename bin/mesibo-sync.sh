#!/bin/sh
#set -e
mkdir -p /etc/mesibo
mkdir -p /mesibo/bin
mkdir -p /mesibo/git
mkdir -p /mesibo/acme
mkdir -p /certs

#yum update -y
yum install -yq git nginx bzip2 psmisc mysql-devel mysql-libs mysql-server curl

sed -c -i "s/\SELINUX=.*/SELINUX=disabled/" /etc/sysconfig/selinux

changed=1
cd /mesibo/git
if [ -d "/mesibo/git/on-premise/.git" ] 
then	
changed=0	
cd /mesibo/git/on-premise/	
git pull | grep -q -v 'Already' && changed=1
else
git clone https://github.com/mesibo/on-premise > /var/tmp/git-onpremise.logs
git config pull.rebase false

chmod a+x /mesibo/git/on-premise/bin/*
/bin/cp -f /mesibo/git/on-premise/bin/*.service /usr/lib/systemd/system/
systemctl daemon-reload

systemctl enable mesibo-sync
fi

if [ $changed -eq 0 ]; then
	systemctl restart mesibo-control
	exit;
fi

chmod a+x /mesibo/git/on-premise/update.sh
/mesibo/git/on-premise/update.sh

chown -R nginx:nginx /mesibo/git/on-premise/control-center/

/bin/cp -f /mesibo/git/on-premise/bin/mesibo-control /mesibo/bin
/bin/cp -f /mesibo/git/on-premise/bin/backend /mesibo/bin
/bin/cp -f /mesibo/git/on-premise/bin/mesibo /mesibo/bin
/bin/cp -f /mesibo/git/on-premise/bin/mesibo-sync.sh /mesibo/bin

systemctl restart mesibo-control
systemctl start mesibo-sync

echo "done"

