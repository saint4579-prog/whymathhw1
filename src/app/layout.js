import './globals.css';

export const metadata = {
  title: '🐶 멍멍! 나의 강아지 수학 복습 다이어리 🐾',
  description: '학원 수학 문제 복습용 웹 애플리케이션',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="bg-amber-50 text-stone-700 antialiased">{children}</body>
    </html>
  );
}
