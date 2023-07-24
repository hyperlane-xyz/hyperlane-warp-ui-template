export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();

  const formattedDate = `${hours}:${minutes < 10 ? '0' : ''}${minutes}${
    hours >= 12 ? 'pm' : 'am'
  } ${month} ${day} ${year}`;

  return formattedDate;
}
