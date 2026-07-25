# 🔔 Cuit Ticker Bell (킷 티커 벨)

> NASDAQ 주식 시장의 실시간 변동성 정지(Volatility Halt/Resume) 정보를 가장 빠르게 캐치하고 알려주는 데스크톱 모니터링 앱입니다.

## ✨ Features

- **⚡ 초고속 실시간 모니터링:** 1초 단위로 화면이 갱신되며, 조건부 GET(HTTP 304) 요청 및 비동기 소켓 통신 백엔드 최적화로 RSS 서버 부하 없이 실시간 데이터를 수집합니다.
- **🔊 스마트 사운드 알림:** 주식 거래 정지(Halt) 및 재개(Resume) 발생 시 커스텀 사운드와 함께 화면 우측 하단 시스템 알림(Toast)을 띄워줍니다.
- **⏱️ 정지 시간 카운트다운:** 정지된 주식이 언제 풀릴지 5분, 10분, 15분 등 단위별로 예상 재개 시간을 카운트다운합니다.
- **🛡️ 자동 업데이트(Auto-Updater):** GitHub Releases와 연동되어 새 버전 출시 시 앱 내에서 원클릭으로 패치 다운로드 및 재시작을 지원합니다.
- **🌙 다크 모드 & 미니멀 UI:** 집중력을 높여주는 세련된 다크 모드와 콤팩트한 팝업 전용 타이머 뷰를 제공합니다.

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Lucide-React
- **Backend (Desktop Core):** Rust, Tauri v2 (Reqwest, quick-xml, tokio)
- **Deployment:** GitHub Releases, Tauri Auto Updater

## 📥 Installation

1. [Releases 페이지](https://github.com/Gyue2/Cuit-Ticker-Bell/releases)에서 최신 버전의 `.msi` 또는 `-setup.exe` 설치 파일을 다운로드하세요.
2. 다운로드한 파일을 실행하여 설치를 완료합니다.
3. 앱 실행 후 화면 우측 상단의 '종소리' 아이콘을 눌러 **윈도우 알림 권한**을 허용해 주시면 백그라운드에서도 안전하게 알림을 받을 수 있습니다.

## 🛠️ Development

### Prerequisites
- Node.js (v18+)
- Rust (stable)
- Visual Studio C++ Build Tools (Windows 환경)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Gyue2/Cuit-Ticker-Bell.git
cd Cuit-Ticker-Bell

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## 📝 License

This project is maintained by Gyue2.
Contact: magicstyle_k@naver.com
