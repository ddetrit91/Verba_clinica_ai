export function MedicFace({
  name,
  photo,
  size = "card",
}: {
  name: string;
  photo: string | null;
  size?: "card" | "row" | "pick";
}) {
  if (photo) {
    return <img className={`medic-face is-${size}`} src={photo} alt="" />;
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");
  return (
    <span className={`medic-face is-${size} is-fallback`} aria-hidden="true">
      {initials}
    </span>
  );
}
