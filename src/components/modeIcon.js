function modeSwitch (mode) {
  switch (mode) {
    case 'BUS': return 'Ⓑ '
    case 'SUBWAY': return 'Ⓜ '
    case 'TRAM': return 'Ⓡ '
    case 'RAIL': return 'Ⓙ '
    case 'FERRY': return 'Ⓛ '
    default:
      break
  }
}

module.exports = {
  modeSwitch
}
