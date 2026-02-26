// Server component — renders JSON-LD structured data in <head> via <script>
// Usage: <JsonLd data={schema} />

interface Props {
  data: Record<string, unknown>;
}

export default function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
