import "./globals.css";

const SITE_TITLE = "픽처히어 | 내 근처 포토부스·인생네컷 지도";
const SITE_DESCRIPTION =
  "지금 내 근처 가장 가까운 포토부스 찾기. 인생네컷, 포토이즘, 포토그레이 등 전국 포토부스·무인사진관 위치를 지도에서 바로 확인하세요.";

export const metadata = {
  metadataBase: new URL("https://picturehere-mu.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "포토부스",
    "근처 포토부스",
    "인생네컷",
    "근처 인생네컷",
    "포토이즘",
    "포토그레이",
    "무인사진관",
    "근처 무인 사진",
    "무인사진",
    "근처 사진관",
    "근처 사진",
    "네컷사진",
    "셀프사진관",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://picturehere-mu.vercel.app",
    siteName: "픽처히어",
    images: ["/apple-icon.png"],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/apple-icon.png"],
  },
  other: {
    "naver-site-verification": "4c1680e67defa46812a76cf9d929991e12889aa4",
    "google-site-verification": "AI13bsT_VaczfH4mY8m-oqBVLBOijsaSl9Ipm-bekYU",
  },
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
