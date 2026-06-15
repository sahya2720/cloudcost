export default function Card({ children, className = '', onClick, noHover = false, style }) {
  return (
    <div
      className={`card${noHover ? ' no-lift' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  );
}