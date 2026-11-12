# ORB DERBY — 구슬 경주 추첨기

[English](README.md) | **한국어**

이름을 넣으면 사람마다 구슬이 하나씩 생기고, 3D 장애물 탑을 굴러 내려가 순위가 정해지는 추첨기입니다.

**플레이:** https://chictimin.github.io/orb-derby/ (브라우저 언어에 따라 한국어·영어로 열리고, KO/EN 버튼으로 언제든 바꿀 수 있습니다.)

## 이렇게 놀아요

1. 로비에서 참가자를 넣습니다.
   - **직접 입력** 탭: 이름을 줄바꿈이나 쉼표로 구분해 2~40명.
   - **QR 참가** 탭: 화면의 QR을 휴대폰으로 찍고 이름을 보내면 명단에 바로 추가됩니다.
2. **선착순 우승** 토글을 고릅니다. 켜면 가장 먼저 도착한 구슬이 우승, 끄면 마지막까지 남은 구슬이 꼴등 당첨입니다.
3. **경주 시작.** 3·2·1 카운트다운 뒤 구슬이 출발 깔때기로 한꺼번에 떨어집니다.
4. 당첨이 확정되면 화면에 알림이 뜨고, 레이스는 전원이 들어올 때까지 이어집니다. 끝나면 전체 순위가 나옵니다.

## 코스

위에서 아래로 쌓인 탑 구조입니다. 구간 사이는 자유낙하로 이어집니다.

| 순서 | 구간 | 볼거리 |
|---|---|---|
| 1 | 출발 깔때기 | 다 같이 떨어져 1차 경쟁, 회전 교반 막대 |
| 2 | 직각 채널 | 지그재그 채널, 회전 쓸개 바, 주기적으로 열리는 함정문(아래 단으로 지름길) |
| 3 | 파이프 | 필터 깔때기에서 갈라지는 반투명 나선 파이프와 지름길 슈트 |
| 4 | 시소 | 흔들리는 시소와 왕복 푸셔 |
| 5 | 핀볼 | 범퍼·핀 격자, 결승 쪽으로 바로 떨어지는 행운 구멍 |
| 6 | 결승 | 회전 원판과 결승 아치 |

트랙 밖으로 떨어지면 떨어지기 직전 자리의 트랙 한가운데로 돌아가고, 3초 이상 끼이면 지나온 체크포인트로 돌아갑니다. 시간 제한은 없습니다.

## 조작

| 기능 | 방법 |
|---|---|
| 배속·일시정지 | HUD 버튼, 키보드 1~4 / P 또는 Space |
| 참가자 시점 | 리더보드나 오른쪽 참가자 목록에서 이름 클릭(다시 누르면 자동 연출) |
| 수동 카메라 | "수동 카메라로 보기" 후 드래그로 회전·확대 |
| 음악 | 음소거 버튼 또는 M, 볼륨 슬라이더 |
| 고화질 | 주소 뒤에 `?quality=high` |
| 언어 | KO/EN 버튼, 또는 `?lang=ko` / `?lang=en` |

## 접근성

- 글자 대비는 WCAG AA(일반 4.5:1, 큰 글자 3:1)를 맞췄습니다.
- 리더보드는 목록 구조이고, 시작·당첨·상위 완주·결과는 스크린리더에 안내됩니다. 움직이는 구슬 이름표는 스크린리더에서 숨깁니다.
- 일시정지가 있고, 운영체제의 '동작 줄이기'를 켜면 카메라 선회와 색종이 효과가 꺼집니다.
- 음악은 첫 클릭이나 키 입력 전에는 재생되지 않습니다.

## QR 참가(P2P)

참가자 휴대폰과 진행자 화면은 [PeerJS](https://peerjs.com/) 공개 서버를 거쳐 WebRTC로 연결됩니다. 이름은 브라우저끼리 직접 오가고, 공개 서버는 연결 중개만 합니다. 사내망이나 일부 공용 Wi-Fi에서는 WebRTC가 막혀 참가가 안 될 수 있습니다. 그때는 직접 입력 탭을 쓰세요.

## 개발

```bash
npm install
npm run dev        # http://localhost:5317 (같은 Wi-Fi의 휴대폰은 Network 주소로)
npm run build      # 타입체크 + 빌드(dist/)
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 자동 배포합니다.

헤드리스 시뮬레이터로 코스를 브라우저 없이 검증할 수 있습니다.

```bash
npx tsx scripts/sim.ts --n 20 --runs 3 --seed 1 --timeout 400          # 탑 전체
npx tsx scripts/sim.ts --sections pipe --n 20 --runs 3 --timeout 60    # 구간 하나
npx tsx scripts/sim.ts ... --why                                       # 낙하·끼임 위치 출력
```

출력의 `finished`는 완주 수, `outs`는 트랙 밖 낙하 복귀 수, `kicks`는 끼임 복귀 수, `rho`는 초반(5초) 순위와 최종 순위의 상관(낮을수록 역전이 많음)입니다.

### 구조

```
src/
  main.ts            물리 루프, 순위·당첨 판정, 낙하·끼임 복귀, 이름표
  types.ts           모듈 간 계약
  i18n.ts            언어 감지, KO/EN 전환, t()
  i18n-dict.ts       한국어·영어 문구
  course/
    assemble.ts      구간을 탑으로 쌓고 진행도·결승 판정
    kit.ts           구간 제작 헬퍼(매끈한 경사로·깔때기·리본 벽 등)
    sections/*.ts    구간 하나 = 파일 하나(자동 수집)
  camera.ts          자동 중계 카메라
  ui.ts              로비·HUD·결과 화면
  party/             QR 참가(PeerJS)
  audio.ts           배경음악
  analytics.ts       Google Tag Manager / GA4(배포판만, 참가자 이름 미전송)
scripts/sim.ts       헤드리스 시뮬레이터
```

기술: TypeScript, [Three.js](https://threejs.org/), [Rapier](https://rapier.rs/)(물리), Vite.

## 크레딧

배경음악은 모두 MintoDog의 CC0 곡입니다. 자세한 출처는 [`public/audio/CREDITS.md`](public/audio/CREDITS.md)에 있습니다.

- Joyfully — https://opengameart.org/content/joyfully
- Pure Raceway — https://opengameart.org/content/pure-raceway
