#!/bin/bash
# webservレポジトリをクローンする
[ -d ./services/webserv ] || git clone -b develop https://github.com/tobeshota/webserv ./services/webserv
cd ./services/webserv

# webservの設定ファイルを更新する
cat << EOF > ./conf/webserv.conf
[localhost]
listen = [8001]
root = "/app/html"
index = "index.html"
EOF

# ft_transcendence_frontend_distボリュームがなければ作る
docker volume ls | grep -q "ft_transcendence_frontend_dist" || make -C ../../ re

# webservをコンテナ内で起動する
docker rm -f webserv > /dev/null 2>&1
docker run \
	--name webserv \
	-p 8001:8001 \
	-v ./srcs:/app/srcs:ro \
	-v ./Makefile:/app/Makefile:ro \
	-v ./conf:/app/conf:ro \
	-v ft_transcendence_frontend_dist:/app/html:ro \
	-d \
	--rm \
	ubuntu:22.04 bash -c \
	"apt-get update && apt-get install -y make g++ && cd /app \
	&& make && ./webserv /app/conf/webserv.conf"

# コンテナ内でwebservが起動するまで待つ
until docker exec webserv pgrep webserv > /dev/null 2>&1; do
	sleep 1
done

GREEN='\033[32m'
RESET='\033[0m'
echo -e "${GREEN}$(cat << 'EOF'
/* ****************************************************************************************** */
/*                                                                                            */
/*                                                                        :::      ::::::::   */
/*   webserv                                                            :+:      :+:    :+:   */
/*                                                                    +:+ +:+         +:+     */
/*   By: toshota <https://github.com/tobeshota/webserv>             +#+  +:+       +#+        */
/*                                                                +#+#+#+#+#+   +#+           */
/*   Created:  2024/11/22 20:22:05 by cjia, smizuoch, toshota         #+#    #+#              */
/*   Finished: 2025/03/23 23:27:00 by cjia, smizuoch, toshota        ###   ########.fr        */
/*                                                                                            */
/* ****************************************************************************************** */

🚀 http://localhost:8001/ on webserv

EOF
)${RESET}"
