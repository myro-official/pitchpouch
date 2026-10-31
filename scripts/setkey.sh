#!/bin/zsh
# 클립보드에 복사한 값을 Vercel Production 환경변수로 등록한다. 값은 화면에 출력되지 않는다.
# 사용: setkey.sh [변수이름]  (생략하면 JEV_API_KEY)
cd "$(dirname "$0")/.." && pbpaste | npx vercel@latest env add "${1:-JEV_API_KEY}" --environment production
