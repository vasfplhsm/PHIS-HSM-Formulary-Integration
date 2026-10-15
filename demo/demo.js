const labels = [
  'Bisoprolol Fumarate 2.5 mg Tablet',
  'Perindopril 4 mg Tablet',
  'Empagliflozin 25 mg Tablet',
  'Isosorbide-5-Mononitrate 60 mg SR Tablet',
  'Glyceryl Trinitrate 0.5 mg Tablet',
  'Trimetazidine 35 mg MODIFIED RELEASE Tablet',
  'Acetylsalicylic Acid 100 mg, Glycine 45 mg Tablet',
  'Dexlansoprazole 30 mg Delayed Release Capsule'
];
function appendMedication(label) {
  const row = document.createElement('tr');
  const checkbox = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'checkbox'; input.setAttribute('aria-label', 'Select mock medication');
  checkbox.append(input); row.append(checkbox);
  const drug = document.createElement('td');
  const name = document.createElement('span'); name.className = 'name';
  // Separate nested spans and a line break resemble wrapping in a PHIS cell.
  const split = label.lastIndexOf(' ');
  const start = document.createElement('span'); start.textContent = label.slice(0, split);
  const end = document.createElement('span'); end.textContent = label.slice(split + 1);
  name.append(start, document.createElement('br'), end);
  const icons = document.createElement('div'); icons.className = 'icons';
  const warning = document.createElement('span'); warning.setAttribute('aria-hidden', 'true'); warning.textContent = '⚠';
  const info = document.createElement('button'); info.type = 'button'; info.textContent = 'i'; info.setAttribute('aria-label', 'Mock PHIS information');
  icons.append(warning, info); drug.append(name, icons); row.append(drug);
  for (const value of ['Mock order — reference only', '—', '—', '—', 'Demo', 'Mock']) {
    const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
  }
  document.getElementById('rows').append(row);
  document.getElementById('medication-count').textContent = document.querySelectorAll('#rows tr').length + ' medications';
  return row;
}
labels.forEach(appendMedication);
document.getElementById('add').onclick = () => appendMedication('Esomeprazole 40 mg Injection');
