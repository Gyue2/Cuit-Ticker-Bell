# 🧚 Cuti-Ticker / KIT FAIRY (킷 요정)
> **미국 주식(NASDAQ, NYSE, AMEX) 변동성 정지(Volatility Halt / LULD / 킷) 실시간 모니터링 & 카운트다운 타이머**

NASDAQ, NYSE, AMEX 전 시장의 거래 정지 현황을 실시간으로 추적하고, 5분·10분·15분 재개 카운트다운 타이머, 음성 알림, 항상 위(Always-On-Top) 팝업 창 및 소식지 클립보드 복사 기능을 제공하는 웹 & 데스크톱 앱입니다.

---

## 🌟 주요 기능 (Key Features)

1. **⚡ 실시간 변동성 정지(LULD / KIT) 모니터링**
   - NASDAQ 공식 RSS 피드 자동 동기화 및 실시간 타임스탬프 산출
   - 당일 종목별 누적 정지 횟수 자동 집계

2. **⏳ 재개 예측 카운트다운 & 알림음**
   - 5분 / 10분 / 15분 주기 예측 카운트다운
   - 재개 임박 (1분 전, 10초 전, 재개 시) 시각적 효과 및 사운드 알림
   - 토스증권(Toss Invest) 바로가기 연결

3. **📌 항상 위(Always-On-Top) 미니 타이머 팝업**
   - 관심 종목 전용 독립 미니 타이머 팝업 창
   - Tauri 데스크톱 환경에서 HTS/MTS 위에 고정 가능 (Pin 기능)

4. **📋 한 줄 소식지 텍스트 복사**
   - 텔레그램 / 카카오톡 / 커뮤니티 전용 공유 텍스트 원클릭 복사

5. **🔍 관심 종목 및 필터링**
   - 시장별, 상태별, 사유별 정밀 필터링 및 즐겨찾기 저장

---

## 📁 프로젝트 구조 (Project Directory)

```text
Cuti-Ticker/
├── .github/
│   └── workflows/
│       └── release.yml     # GitHub Actions Tauri 자동 빌드 & Release 워크플로우
├── src/                    # React 18 / TypeScript / Tailwind CSS 프론트엔드
├── src-tauri/              # Tauri v2 (Rust) 데스크톱 설정
│   ├── tauri.conf.json
│   └── Cargo.toml
├── package.json            # Node.js 프로젝트 설정
├── package-lock.json       # npm 의존성 잠금 파일 (GitHub Actions 빌드 필수)
├── server.ts               # Express RSS 프록시 & 시각 동기화 서버
├── vite.config.ts          # Vite 빌드 설정
└── README.md               # 프로젝트 안내 문서
```

---

## 🚀 빠른 시작 (Quick Start)

### 1. 의존성 설치 및 로컬 개발 서버 실행

```bash
# 1. 패키지 설치
npm install

# 2. 로컬 웹 서버 실행 (http://localhost:3000)
npm run dev
```

### 2. 웹 프로덕션 빌드 & 실행

```bash
npm run build
npm start
```

---

## 🖥️ Tauri 데스크톱 앱 빌드 (Desktop App)

### 사전 준비 사항 (Prerequisites)
- **Node.js** (v18 이상)
- **Rust**: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
- **Windows**: C++ Build Tools (Visual Studio Installer)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)

### 데스크톱 앱 개발 및 빌드 명령어

```bash
# Tauri 로컬 개발 모드 (데스크톱 앱 창 실행)
npm run tauri dev

# 설치 파일 (.exe / .dmg / .app) 빌드
npm run tauri build
```

---

## 🐙 GitHub 푸시 및 자동 빌드 (GitHub Release guide)

이 프로젝트에는 **GitHub Actions** 워크플로우(`.github/workflows/release.yml`)가 포함되어 있어, Git Tag를 푸시하면 **Windows `.exe`** 및 **macOS `.app`** 파일이 자동으로 빌드되어 GitHub Release에 업로드됩니다.

### 1. 변경사항 깃 커밋 및 푸시

```bash
git add .
git commit -m "feat: Prepare release v1.0.3"
git push origin main
```

### 2. 새 릴리즈 태그 생성 및 푸시 (GitHub Actions 트리거)

기존 태그와 충돌이 나는 경우 새로운 버전 태그(예: `v1.0.3`)를 생성하여 푸시하세요:

```bash
# 태그 생성
git tag v1.0.3

# 태그 푸시 (이 명령이 실행되면 GitHub Actions 자동 빌드가 시작됩니다!)
git push origin v1.0.3
```

> 💡 **태그 중복 에러 발생 시 처리 방법 (`already exists`):**
> 
> ```bash
> # 로컬 태그 삭제
> git tag -d v1.0.2
> 
> # 원격(GitHub) 태그 삭제
> git push origin --delete v1.0.2
> 
> # 그 후 새 버전(v1.0.3)으로 생성하여 푸시
> git tag v1.0.3
> git push origin v1.0.3
> ```

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Desktop**: Tauri v2, Rust
- **Backend / Proxy**: Express, Node.js
- **Build Tools**: Vite, esbuild, GitHub Actions

---

## 📄 라이선스 (License)

MIT License
