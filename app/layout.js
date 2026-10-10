import "./globals.css";

export const metadata = {
  title: "픽처히어",
  description: "주변 즉석사진(네컷사진) 매장을 반경별로 찾아보는 지도, 픽처히어",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Gmarket Sans — Jua는 너무 둥글다는 피드백으로 교체. Light/Medium/Bold 3웨이트가
            있는 "둥글지만 트렌디한" 한글 서체 (Google Fonts엔 없어 CDN으로 로드) */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/GmarketSans/GmarketSans.css" />
        {/* Pretendard — Gmarket Sans가 못 그리는 글자 대비용 보조 서체 (Google Fonts엔 없어 CDN으로 로드) */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
