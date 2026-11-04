export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 64" aria-hidden="true">
      <path d="M24 62 V14" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 42 C12 36 6 26 5 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 36 C36 30 42 20 43 10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 28 C15 23 11 16 10 8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 24 C33 19 37 13 38 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
