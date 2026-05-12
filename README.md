# Life Agent Bot

Telegram에서 쓰는 개인용 로컬 AI 봇입니다. Telegram Bot polling으로 메시지를 받고,
로컬 Ollama의 Gemma 계열 모델에 질문을 전달합니다.

## 현재 기능

- Telegram Bot polling
- `/ask`: 빠른 모델로 질문
- `/deep`: 큰 모델로 깊은 질문
- `/code`: 코딩용 시스템 프롬프트로 질문
- `/memory`: 저장된 대화 맥락 확인
- `/reset`: 현재 채팅의 대화 맥락 초기화
- `/status`: Ollama 상태, 모델 목록, git 브랜치/커밋 확인
- `/update`: 현재 브랜치 업데이트 후 빌드하고 프로세스 재시작
- `/help`: 사용법 출력
- 이미지 메시지 분석
- Telegram slash command 등록
- typing 표시 유지
- 긴 메시지 분할 전송
- 답변 Markdown 일부를 Telegram 서식으로 표시
- 허용된 Telegram user id만 사용 가능
- 여러 Telegram user id 허용
- 사진 caption에서 `/deep`, `/code` 모델 선택
- 파일 기반 대화 메모리: 최근 대화는 원문으로, 오래된 대화는 요약으로 저장

## 준비물

- Node.js
- npm
- Ollama
- Telegram BotFather에서 발급한 봇 토큰
- 사용할 Ollama 모델

모델 이름은 로컬에 설치된 이름과 정확히 맞아야 합니다.

```bash
ollama list
```

## 빠른 시작

```bash
cd ~/code/life-agent-bot
npm install
cp .env.example .env
```

그 다음 `.env`에 Telegram bot token과 허용할 Telegram user id를 넣고 실행합니다.

```bash
npm run dev
```

Telegram에서 봇에게 `/start`를 보내 응답이 오면 기본 설정은 끝입니다.

운영용으로 계속 켜두려면 systemd 서비스를 등록합니다.

```bash
scripts/install-systemd-service.sh
```

등록 후에는 Telegram에서 `/status`로 상태를 확인합니다.

## 환경변수

실제 비밀값은 `.env`에만 넣습니다. `.env.example`은 예시 파일이라 커밋해도 되지만,
`.env`는 `.gitignore`에 들어 있어서 커밋하지 않습니다.

`.env` 예시:

```bash
TELEGRAM_BOT_TOKEN=BotFather에서_새로_발급받은_봇_토큰
ALLOWED_TELEGRAM_USER_ID=내_Telegram_user_id,여자친구_Telegram_user_id
ALLOW_ALL_USERS_DURING_SETUP=false

OLLAMA_BASE_URL=http://localhost:11434

FAST_MODEL=gemma4:e4b
DEEP_MODEL=gemma4:26b
CODE_MODEL=gemma4:26b
VISION_MODEL=gemma4:e4b

MEMORY_DATA_DIR=.data
MEMORY_MAX_RECENT_TURNS=16
```

값 설명:

- `TELEGRAM_BOT_TOKEN`: BotFather에서 받은 봇 토큰입니다. 이전에 노출된 토큰이면 BotFather에서 revoke/regenerate 후 새 토큰을 넣습니다.
- `ALLOWED_TELEGRAM_USER_ID`: 봇을 쓸 수 있는 Telegram user id 목록입니다. 한 명이면 숫자 하나, 여러 명이면 쉼표로 구분합니다.
- `ALLOW_ALL_USERS_DURING_SETUP`: 처음 user id를 확인할 때만 `true`로 둡니다. 확인 후에는 반드시 `false`로 바꿉니다.
- `OLLAMA_BASE_URL`: Ollama 서버 주소입니다. 같은 PC/WSL에서 Ollama가 돌면 보통 `http://localhost:11434`입니다.
- `FAST_MODEL`: `/ask`와 일반 메시지에 쓸 빠른 모델입니다.
- `DEEP_MODEL`: `/deep`에 쓸 큰 모델입니다.
- `CODE_MODEL`: `/code`에 쓸 코딩용 모델입니다.
- `VISION_MODEL`: 이미지 메시지를 분석할 모델입니다. 값을 비우면 코드 기본값은 `FAST_MODEL`과 같은 모델입니다.
- `MEMORY_DATA_DIR`: 대화 메모리를 저장할 폴더입니다. 비워두면 대화 메모리는 비활성화됩니다. 설정하면 폴더 안에 `life-agent-memory.json` 파일을 만듭니다.
- `MEMORY_MAX_RECENT_TURNS`: 최근 대화 원문을 유지할 개수입니다. 이 개수를 넘은 오래된 대화는 요약에 흡수됩니다. 기본값은 `16`입니다.

여러 명이 쓰려면 이렇게 넣습니다.

```bash
ALLOWED_TELEGRAM_USER_ID=123456789,987654321
```

공백이 있어도 됩니다.

```bash
ALLOWED_TELEGRAM_USER_ID=123456789, 987654321
```

## 최초 실행

Telegram user id를 모르면 처음에는 setup mode로 실행합니다.

1. `.env`에서 `TELEGRAM_BOT_TOKEN`만 먼저 채웁니다.
2. `ALLOWED_TELEGRAM_USER_ID`는 비워둡니다.
3. `ALLOW_ALL_USERS_DURING_SETUP=true`로 둡니다.
4. 개발 모드로 봇을 실행합니다.

```bash
npm run dev
```

5. Telegram에서 봇에게 `/start`를 보냅니다.
6. 응답에 표시되는 `your telegram user id` 숫자를 `.env`의 `ALLOWED_TELEGRAM_USER_ID`에 넣습니다.
7. `ALLOW_ALL_USERS_DURING_SETUP=false`로 바꿉니다.
8. 실행 중인 터미널에서 `Ctrl+C`로 종료하고 다시 실행합니다.

```bash
npm run dev
```

## 실행

개발 모드:

```bash
npm run dev
```

빌드 후 실행:

```bash
npm run build
npm start
```

운영 모드:

```bash
scripts/install-systemd-service.sh
systemctl --user status life-agent-bot --no-pager
journalctl --user -u life-agent-bot -f
```

`scripts/install-systemd-service.sh`는 기본적으로 현재 사용자 systemd 서비스로 설치합니다.
현재 저장소 경로, 현재 사용자, 실제 `npm` 경로를 감지하므로 clone 위치가 달라도 그대로 쓸 수 있습니다.
다른 서비스 이름으로 설치하려면 이렇게 실행합니다.

```bash
SERVICE_NAME=my-life-agent scripts/install-systemd-service.sh
```

시스템 전체 서비스로 설치해야 하면 `sudo` 권한이 필요합니다.

```bash
scripts/install-systemd-service.sh --system
```

사용자 로그인 전에도 자동 시작되어야 하는 서버라면 사용자 서비스 설치 후 아래 설정이 추가로 필요할 수 있습니다.

```bash
loginctl enable-linger "$USER"
```

## 명령어

- `/ask 질문`: `FAST_MODEL`로 빠르게 답합니다.
- `/deep 질문`: `DEEP_MODEL`로 더 깊게 답합니다.
- `/code 질문`: `CODE_MODEL`과 코딩용 시스템 프롬프트로 답합니다.
- `/memory`: 현재 채팅에 저장된 대화 요약과 최근 원문 맥락을 보여줍니다.
- `/reset`: 현재 채팅의 대화 맥락을 지웁니다.
- `/status`: Ollama 상태, 모델 목록, git 브랜치, git 커밋을 보여줍니다.
- `/update`: 현재 체크아웃된 브랜치를 `git pull --ff-only`로 업데이트하고, `npm install`, `npm run build` 후 재시작합니다.
- `/help`: 사용법을 보여줍니다.

일반 텍스트 메시지는 `/ask`처럼 처리됩니다.

`MEMORY_DATA_DIR`를 설정하면 봇은 채팅방별로 대화 맥락을 저장합니다. 답변할 때는 저장된 요약과 최근 원문 대화를 질문 앞에 붙여 모델에 전달합니다. 답변을 Telegram에 보낸 뒤 이번 질문과 답변을 저장하고, 최근 원문 개수가 `MEMORY_MAX_RECENT_TURNS`를 넘으면 오래된 부분을 `FAST_MODEL`로 요약해 압축합니다.

답변에 포함된 Markdown은 Telegram에서 보이는 서식으로 일부 변환됩니다.

지원하는 대표 서식:

- `**굵게**`
- `_기울임_`
- `` `인라인 코드` ``
- fenced code block
- `[링크](https://example.com)`

Telegram이 서식 파싱에 실패하면 원문 텍스트로 다시 보냅니다.

이미지를 보내면 기본적으로 `VISION_MODEL`로 분석합니다. 사진 caption에 질문을 같이 쓰면 그 질문을 사용합니다.

예:

```text
[음식 사진]
이거 음식 뭐야?
```

caption 없이 이미지만 보내면 기본 이미지 설명 프롬프트로 답합니다.

사진 caption을 `/deep`으로 시작하면 `DEEP_MODEL`이 이미지를 봅니다.

```text
[음식 사진]
/deep 이 음식이 뭔지 자세히 봐줘
```

사진 caption을 `/code`로 시작하면 `CODE_MODEL`이 이미지를 봅니다. 에러 화면, 코드 스크린샷 등을 보낼 때 쓸 수 있습니다.

```text
[에러 화면 사진]
/code 이 에러 원인 분석해줘
```

주의할 점:

- 사진을 먼저 보내고 나중에 `/deep ...` 텍스트를 보내면, 현재 구조에서는 앞의 사진을 기억하지 않습니다.
- 사진 전송 전에 caption 입력칸에 `/deep ...` 또는 `/code ...`를 같이 적어 보내야 합니다.

## `/update` 동작 방식

`/update`는 현재 브랜치가 `main`이든 `master`든 하드코딩하지 않고 현재 체크아웃된 브랜치를 업데이트합니다.

실행 순서:

```bash
git pull --ff-only
npm install
npm run build
```

성공하면 `.update-ready` 임시 파일을 남기고 프로세스를 종료합니다. systemd 서비스가 등록되어 있으면
`Restart=always` 설정으로 봇이 다시 뜨고, 새 프로세스가 `.update-ready`를 읽어 같은 Telegram 채팅방에 아래 메시지를 보냅니다.

```text
업데이트 후 재시작 완료.
사용 준비가 끝났습니다.
```

이 기능은 systemd 같은 프로세스 매니저가 봇을 다시 실행한다는 전제에서 동작합니다.
처음 설치했다면 아래 명령으로 먼저 서비스를 등록하세요.

```bash
scripts/install-systemd-service.sh
```

서비스 상태와 로그:

```bash
systemctl --user status life-agent-bot --no-pager
journalctl --user -u life-agent-bot -f
```

문제가 생겼을 때는 아래 순서로 보면 됩니다.

```bash
systemctl --user status life-agent-bot --no-pager
journalctl --user -u life-agent-bot -n 100 --no-pager
ls -la .update-ready
```

`.update-ready`가 남아 있으면 새 프로세스가 준비 완료 알림 단계까지 도달하지 못한 것입니다.
`.update-ready`가 없어졌는데 Telegram 메시지가 없다면 Telegram API 전송이 실패했을 가능성이 큽니다.

## 언어별 README에 대해

GitHub의 기본 README는 사용자 언어 설정에 따라 자동으로 바뀌지 않습니다. 나중에 영어 문서도 필요하면
`README.md`는 한국어로 유지하고, `README.en.md`를 추가해서 서로 링크하는 방식이 가장 단순합니다.
