#!/bin/zsh
# 클립보드에 복사한 키를 Vercel Production 환경변수로 등록한다. 값은 화면에 출력되지 않는다.
# 사용: setkey.sh [변수이름]  (생략하면 JEV_API_KEY). 이미 있으면 지우고 다시 만든다.
name="${1:-JEV_API_KEY}"
v="$(pbpaste)"
# 키는 공백 없는 한 줄의 ASCII다. 다른 텍스트가 복사돼 있으면 등록하지 않는다.
if [[ ! "$v" =~ ^[!-~]{20,}$ ]]; then
  echo "클립보드가 키 형식이 아니에요(길이 ${#v}). 키만 다시 복사한 뒤 실행해 주세요."
  exit 1
fi
cd "$(dirname "$0")/.." || exit 1
npx vercel@latest env rm "$name" production --yes >/dev/null 2>&1
printf '%s' "$v" | npx vercel@latest env add "$name" --environment production
echo "등록 완료: $name (길이 ${#v})"
