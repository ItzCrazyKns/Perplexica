export async function fetchNewsData(id: string) {
  const response = await fetch(
    `https://raw.githubusercontent.com/newspedia-crew/newspedia-web/intern-change/public/data/${id}.json`,
  );
  if (!response.ok) {
    return null;
  }
  return response.json();
}
