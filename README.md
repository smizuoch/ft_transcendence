# ft_transcendence
**ft_transcendence is a multi-player online PONG using [WebRTC SFU](https://scrapbox.io/guide-to-the-galaxy/WebRTC_SFU)🏓**  
**The goal is to build a web application in close collaboration with teammates under a two-month time constraint.**

---

# Description
https://github.com/user-attachments/assets/abd20fa5-3511-43d6-981d-3e9cf33ae030
<div style="display: flex; gap: 10px; margin: 20px 0;">
  <img src="https://github.com/user-attachments/assets/6051b7c1-5c61-40d7-aa76-3102c1b90ab3" alt="Home" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/b30e298e-5966-44b9-8923-52bcfbac9390" alt="UserRegistration" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/a3414b42-cdcb-4c05-b6a3-cc4c4e9afd5a" alt="EmailVerification" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/02c57a7b-7e1a-4207-810d-39984ebfcc3d" alt="TwoFactorAuth" style="width: 24%; height: auto;">
</div>
<div style="display: flex; gap: 10px; margin: 20px 0;">
  <img src="https://github.com/user-attachments/assets/37edbbbb-351d-4366-9ffe-642712deca08" alt="GoogleAuth" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/2eae4b09-08c1-4c03-b082-14fe216d89d8" alt="MyPage" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/0e72b726-62db-448c-8b03-353ee52cf3f5" alt="UserProfile" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/c14ceab9-5664-4693-a61c-9b06360288b0" alt="ELKStack" style="width: 24%; height: auto;">
</div>
<div style="display: flex; gap: 10px; margin: 20px 0;">
  <img src="https://github.com/user-attachments/assets/5192c02f-12bf-4e4f-b5b3-5215127dda41" alt="GameSelect" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/5d09b6e9-0553-4106-904f-6855f9966def" alt="GamePong2" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/b9714cab-c8dd-4c84-b35c-0fd633d1edca" alt="GamePong4" style="width: 24%; height: auto;">
  <img src="https://github.com/user-attachments/assets/bb515316-1af5-46f4-ae86-23e820e794f2" alt="GamePong42" style="width: 24%; height: auto;">
</div>

For more information:
* [DeepWiki](https://deepwiki.com/smizuoch/ft_transcendence/1-overview)
* [guide-to-the-galaxy](https://scrapbox.io/guide-to-the-galaxy/ft_transcendence潮時)

# Usage
### Requirements
- Docker Desktop
```shell
brew install --cask docker
```

### 1. Install
```shell
# Clone this repository
git clone https://github.com/smizuoch/ft_transcendence
# Change directory to this repository
cd ft_transcendence
# Create env file
cp ./secrets/.env.example ./secrets/.env
```

### 2. Configure `./secrets/.env`
| Variable | Description | Example |
| --- | --- | --- |
| HOST_IP | Your local machine's IP address | 192.168.1.100 |
| ANNOUNCED_IP | Your local machine's IP address | 192.168.1.100 |
| GOOGLE_CLIENT_ID | Google OAuth client ID | your-id.googleusercontent.com |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | your-secret |
| SMTP_HOST | Email server for 2FA | smtp.gmail.com |
| SMTP_USER | Email account for 2FA | your-email@gmail.com |
| SMTP_PASS | Email app password | your-app-password |

### 3. Launch Application
```shell
# Launch the Docker containers
make up
```

### 4. SSL Certificate Setup
Register the public key certificate `./secrets/certs/ca.crt` in your web browser.

### 5. Access
Access via your web browser: `https://HOST_IP:8443/`  
**NOTE**: Replace HOST_IP with Your local machine's IP address

# Technology Stack

<details>
<summary>View Technology Stack</summary>

## Core Technologies
| Technology | Purpose |
|------------|---------|
| [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/) | Frontend Framework |
| [Tailwind CSS](https://tailwindcss.com/) | CSS Framework |
| [Node.js](https://nodejs.org/) + [NestJS](https://nestjs.com/) | Backend Runtime & Framework |
| [Fastify](https://fastify.dev/) | HTTP Server |
| [MediaSoup](https://mediasoup.org/) | WebRTC SFU for Real-time Communication |
| [Socket.IO](https://socket.io/) | WebSocket Communication |
| [Prisma](https://www.prisma.io/) + [SQLite](https://sqlite.org/) | Database & ORM |

## Infrastructure
| Technology | Purpose |
|------------|---------|
| [Docker](https://www.docker.com/) | Containerization |
| [nginx](https://nginx.org/) | Reverse Proxy |
| [webserv](https://github.com/tobeshota/webserv) | Serving with my own HTTP/1.1 server :D |
| [ELK Stack](https://www.elastic.co/) | Log Analysis |

</details>


# Development Process

| Task | Purpose | Definition of Done |
|------|---------|-------------------|
| [Preliminary Study](https://scrapbox.io/guide-to-the-galaxy/【4%2F23_-_5%2F02】ft_transcendence事前学習) | Understand web apps | Implement a simple web app |
| [Requirement Definition](https://scrapbox.io/guide-to-the-galaxy/【5%2F08_-_5%2F09】ft_transcendence要件定義) | Define project scope | Create a requirements document |
| [Design](https://scrapbox.io/guide-to-the-galaxy/【5%2F13_-_5%2F16】ft_transcendence設計) | Plan the architecture | Write a [Screen Design Document](https://scrapbox.io/guide-to-the-galaxy/ft_transcendence画面設計書) and a [DB Design Document](https://scrapbox.io/guide-to-the-galaxy/ft_transcendenceDB設計書) |
| [Implementation](https://docs.google.com/spreadsheets/d/1m0k-AYQ1fprnzzoou5p9SSvFhIgakw8mnbiXoMJMcwo/edit?gid=543851996#gid=543851996) | Build the project | Make all screens functional |

# System Architecture
A [microservices](https://scrapbox.io/guide-to-the-galaxy/microservices) architecture was chosen for independent development and deployment.
```mermaid
flowchart LR
    Users[End users]
    nginx[nginx]

    subgraph "API"
        auth[auth]
        user_search[user_search]
        friend_search[friend_search]
        result_search[result_search]
        npc_manager[npc_manager]
    end


    sfu[sfu]
    sfu42[sfu42]

    subgraph "Log Analysis"
        logstash[logstash]
        elasticsearch[elasticsearch]
        kibana[kibana]
        logstash -.-> |HTTP| elasticsearch
        elasticsearch -.-> |HTTPS| kibana
    end

    Users -.-> |HTTPS| nginx
    nginx -.-> |HTTP| frontend
    nginx -.-> |HTTP| auth
    nginx -.-> |HTTP| user_search
    nginx -.-> |HTTP| friend_search
    nginx -.-> |HTTP| result_search

    Users <-.-> |WebRTC| sfu
    Users <-.-> |WebRTC| sfu42
    sfu42 <-.-> |WebRTC| npc_manager

    Users -.-> |HTTPS| kibana

    %% Styling
    classDef user fill:#e3f2fd
    classDef frontend fill:#e8f5e8
    classDef api fill:#fff3e0
    classDef elk fill:#e0f2f1

    class Users user
    class frontend frontend
    class auth,user_search,friend_search,result_search,npc_manager api
    class logstash,elasticsearch,kibana elk
```

# Afterword
_ft_transcendence is the final project of the Common Core at [42](https://42tokyo.jp/)._

_The two years I spent at 42 were time to learn how to learn._  
_It was a daily routine of mobilizing people, books, and AI to adapt to unknown rules and apply them to the problems at hand._

_And you know… [our spacewalk](https://scrapbox.io/guide-to-the-galaxy/) isn’t over just yet :D_
