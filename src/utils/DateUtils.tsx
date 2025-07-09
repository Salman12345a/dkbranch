export const formatISOToCustom = (isoString: string) => {
  const date = new Date(isoString);

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  const day = date.getUTCDate();
  const month = months[date.getMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};
