#!/bin/bash
# webservレポジトリをクローンする
[ -d ./services/webserv ] || git clone https://github.com/tobeshota/webserv ./services/webserv
cd ./services/webserv

# webservの設定ファイルを作成する
[ -f ./webserv.conf ] || cat << EOF > ./conf/webserv.conf
[localhost]
listen = [80]
root = "/app/html"
index = "index.html"
EOF

# webservをコンテナ内で起動する
docker rm -f webserv > /dev/null
docker run \
	--name webserv \
	-p 8080:80 \
	-v ./srcs:/app/srcs:ro \
	-v ./Makefile:/app/Makefile:ro \
	-v ./conf:/app/conf:ro \
	-v ft_transcendence_frontend_dist:/app/html:ro \
	ubuntu:22.04 bash -c "apt-get update && apt-get install -y make g++ && cd /app && make && ./webserv /app/conf/webserv.conf" &

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
/*   Created:  2024/11/22 20:22:05 by cjia, smizuoch, toshota         #+#    #+#             */
/*   Finished: 2025/03/23 23:27:00 by cjia, smizuoch, toshota        ###   ########.fr       */
/*                                                                                            */
/* ****************************************************************************************** */
EOF
)${RESET}"
