interface Props {
  title: string;
}

export default function PageShell({ title }: Props) {
  return (
    <div>
      <h1 style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, marginBottom: 0 }}>
        {title}
      </h1>
      <div style={{ width: 40, height: 3, background: '#E91C24', borderRadius: 2, margin: '10px 0 20px' }} />
      <p style={{ color: '#CCCCCC', fontSize: 15 }}>Coming Soon</p>
    </div>
  );
}
