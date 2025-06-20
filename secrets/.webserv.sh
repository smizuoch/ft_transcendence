#!/bin/bash
ENV_FILE=./secrets/.env
[ -f "$ENV_FILE" ] || { echo "Error: $ENV_FILE not found"; exit 1; }

# HOST_IPの取得
HOST_IP=$(grep "^HOST_IP=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
[ -n "$HOST_IP" ] || { echo "Error: HOST_IP not found in $ENV_FILE"; exit 1; }

# webservレポジトリをクローンする
[ -d ./services/webserv ] || git clone -b develop https://github.com/tobeshota/webserv ./services/webserv
cd ./services/webserv

# webservの設定ファイルを更新する
cat << EOF > ./conf/webserv.conf
["$HOST_IP"]
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
	--network ft_transcendence_transcendence_net \
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
	echo "waiting ..."
	sleep 3
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
EOF
)${RESET}"

printf "\n\e[32m🏓 http://$HOST_IP:8001/ on webserv\e[m\n"
