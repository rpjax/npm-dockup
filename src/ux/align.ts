export function formatRow(label: string, value: string, width = 14): string {
  const padded = label.padEnd(width);
  return `  ${padded}${value}`;
}

export function formatIndentedList(items: string[]): string[] {
  return items.map((item) => `       │ ${item}`);
}
