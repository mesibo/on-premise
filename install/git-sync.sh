#!/bin/sh
changed=1
mkdir -p /mesibo/git
cd /mesibo/git
if [ -d "/mesibo/git/on-premise/.git" ] 
then	
changed=0	
cd /mesibo/git/on-premise/	
git pull | grep -q -v 'Already' && changed=1
else
git clone https://github.com/mesibo/on-premise > /var/tmp/git-onpremise.logs
fi
echo $changed
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

chmod a+x /mesibo/bin/mesibo-control
chmod a+x /mesibo/bin/mesibo
chmod a+x /mesibo/bin/backend

systemctl restart mesibo-control

echo "done"

