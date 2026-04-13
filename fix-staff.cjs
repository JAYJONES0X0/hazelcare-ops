const fs = require('fs');
let code = fs.readFileSync('src/pages/StaffMonitoringPage.tsx', 'utf-8');

code = code.replace("import { Sparkles, LayoutGrid, ShieldAlert, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, CheckCircle } from 'lucide-react';", "import { Sparkles, Download, RefreshCw, ChevronRight, Activity, MessageSquare, History, FileText, CheckCircle } from 'lucide-react';");

// Remove unused state
code = code.replace(/const \[outcomeNotes, setOutcomeNotes\].*\n/g, "");
code = code.replace(/const \[outcomeType, setOutcomeType\].*\n/g, "");

// Remove unused collapse tools
code = code.replace("const { isCollapsed: isPanelCollapsed, toggle: togglePanel, collapseAll: collapseAllPanels, expandAll: expandAllPanels, allCollapsed: allPanelsCollapsed } = useCollapseStore('staff-monitoring-panels');", "const { collapseAll: collapseAllPanels, expandAll: expandAllPanels, allCollapsed: allPanelsCollapsed } = useCollapseStore('staff-monitoring-panels');");

// Remove unused refs
code = code.replace(/const rewriteRef = useRef<HTMLTextAreaElement>\(null\);\n/g, "");

// Remove copyStaffTool
code = code.replace(/async function copyStaffTool\(tool: string\) \{[\s\S]*?\}\n/g, "");

// Remove copyCoachingMessage
code = code.replace(/function copyCoachingMessage\(\) \{[\s\S]*?setTimeout\(\(\) => setCoachCopied\(false\), 2500\);\n  \}\n/g, "");

fs.writeFileSync('src/pages/StaffMonitoringPage.tsx', code);
console.log('Fixed');
