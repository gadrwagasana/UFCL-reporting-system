// Diagnostic entry point — catches module load errors and shows them on screen.
// Temporary: remove once startup crash is fixed.
export {};
const { AppRegistry } = require('react-native');
const React = require('react');
const { View, Text, ScrollView } = require('react-native');

let RootApp: any;
let loadError: string | null = null;

try {
  RootApp = require('./App').default;
} catch (e: any) {
  loadError = String(e?.message ?? e) + '\n\n' + String(e?.stack ?? '');
}

function ErrorDisplay() {
  return React.createElement(
    View,
    { style: { flex: 1, backgroundColor: '#600', padding: 24, paddingTop: 60 } },
    React.createElement(Text, { style: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 } }, 'UFCL Startup Error'),
    React.createElement(ScrollView, null,
      React.createElement(Text, { style: { color: '#fcc', fontSize: 11 } }, loadError)
    )
  );
}

AppRegistry.registerComponent('main', () => loadError ? ErrorDisplay : RootApp);
