export function generateKitCopyText(
  symbol: string,
  name: string,
  targetCount: number,
  addMs: number[],
  intervals: number[],
  reasonCode?: string
): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${pad2(d.getHours())}시 ${pad2(d.getMinutes())}분 ${pad2(d.getSeconds())}초`;
  };

  const greetings = [
    "킷 요정 등장!🧚",
    "킷 요정 입니다!🧚",
  ];

  const emojiSets = [
    "⚡✨🚀",
    "💫📈🔔",
    "⚡💥🎯",
    "✨💸📊",
    "🚀✨💎",
    "⚡✨🌟",
    "🔥🔴💰",
    "🎯🛡️🚀",
    "🍀⭐⚡",
    "📊⚡💸",
    "🔮✨💎",
    "🚩💥🚀",
  ];

  const cheers = [
    "킷! 상승 해제 후 불기둥 가즈아! 🚀🔥",
    "🔥 해제 직후 변동성 주의! 손절선 지키며 성투하세요! 🛡️✨",
    "⚡ 재개 시점(5분) 타이밍 체크하고 대박나세요! 💸💪",
    "💎 킷 타이밍! 🚀✨",
    "🚀 킷 해제 후 상방 슛팅 가즈아!🔴🔥",
    "🎯 뇌동매매 금지! 🧠💥",
    "☕ 정지 5분 동안 커피 한 잔의 여유! 차분하게 해제 준비하세요! ☕📈",
    "👑 파동 타고 무조건 계좌 양봉 만들어봅시다! 가즈아~ 🚀💸",
    "📈 상승 응원합니다! 💰✨",
    "🛡️ 모아니면 도! 욕심 줄이고 줄먹 필수! 🎯✨",
    "💸 킷 요정이 응원합니다! 오늘 계좌 상쾌하게 빨간불 켜세요! 🔴🔥",
    "💥 킷 해제 첫 양봉 확인 후 진입! 방심은 금물, 매매 화이팅! 💪✨",
    "🚀 데이트레이더의 영혼을 담아! 대박 수익 기원합니다! 🔥💰",
    "🌈 킷 포착! 익절은 언제나 옳다! 적절히 챙기며 성투하세요! 💎💸",
    "📊 정지 타임! 해제 호가창 잘 확인하시고 성투하세요! 🛡️🚀",
    "🎉 욕심 버리고 기계적인 익절! 주포따라 성투하세요! 💰✨",
    "🔔 킷 요정 특보! 집중력 유지하고 목표 수익 달성해보아요! 💪✨",
    "✨ 살아남는 자가 승자! 성투하세요! 🧠🚀",
  ];

  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  const randomEmojis = emojiSets[Math.floor(Math.random() * emojiSets.length)];
  const randomCheer = cheers[Math.floor(Math.random() * cheers.length)];

  const reasonTag = reasonCode ? ` [${reasonCode}]` : "";

  return `${randomGreeting} ${randomEmojis}\n\n${symbol} (${name})${reasonTag} - 오늘 ${targetCount}번째 킷⚡\n\n${fmt(
    addMs[0]
  )}   /    ${intervals[0]}분 킷\n${fmt(addMs[1])}   /   ${intervals[1]}분 킷\n${fmt(addMs[2])}   /   ${intervals[2]}분 킷\n\n${randomCheer}`;
}
