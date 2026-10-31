#!/bin/zsh
# 클립보드의 "이름=값" 줄들을 Vercel Production 환경변수로 한꺼번에 등록한다. 값은 출력하지 않는다.
# 사용: pbpaste | scripts/setenv.sh   (시험만 하려면 DRY_RUN=1을 앞에 붙인다)
# 아래 목록에 있는 이름만 등록하고, 이미 있는 변수는 지우고 다시 만든다.
allowed=(IG_VERIFY_TOKEN IG_USER_ID IG_APP_SECRET IG_ACCESS_TOKEN NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY)
cd "$(dirname "$0")/.." || exit 1
ok=0
bad=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "${line// }" ]] && continue
  if [[ "$line" != *=* ]]; then
    echo "건너뜀: '이름=값' 모양이 아닌 줄(길이 ${#line})"
    bad=$((bad + 1))
    continue
  fi
  name="${line%%=*}"
  value="${line#*=}"
  if (( ${allowed[(Ie)$name]} == 0 )); then
    echo "건너뜀: 이름이 목록에 없는 줄"
    bad=$((bad + 1))
    continue
  fi
  # 값은 공백 없는 한 줄의 ASCII다. 한글 등 다른 텍스트가 섞이면 등록하지 않는다.
  if [[ ! "$value" =~ ^[!-~]{6,}$ ]]; then
    echo "건너뜀: $name 값 형식이 이상해요(길이 ${#value})"
    bad=$((bad + 1))
    continue
  fi
  if [[ -n "$DRY_RUN" ]]; then
    echo "(시험) 등록 예정: $name (길이 ${#value})"
    ok=$((ok + 1))
    continue
  fi
  npx vercel@latest env rm "$name" production --yes >/dev/null 2>&1
  if printf '%s' "$value" | npx vercel@latest env add "$name" --environment production >/dev/null 2>&1; then
    echo "등록 완료: $name (길이 ${#value})"
    ok=$((ok + 1))
  else
    echo "실패: $name"
    bad=$((bad + 1))
  fi
done
echo "합계: 성공 ${ok}개, 건너뜀 또는 실패 ${bad}개"
