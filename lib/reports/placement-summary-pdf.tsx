import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { PWA_CONFIG } from "@/lib/pwa/config";

// A real, data-backed placement summary — every number comes straight from
// lib/analytics/stats.ts, the same source the live Analytics page uses.
// Deliberately NOT labeled as an official NIRF/NAAC-format submission:
// those accreditation bodies have specific, versioned templates this app
// doesn't have on file, and claiming exact compliance we haven't verified
// against the current cycle's actual format would risk the college
// submitting something that looks right but silently isn't. This gives
// the real underlying data in a clean report shape instead, for whoever
// prepares the official submission to adapt.
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 4, fontWeight: 700 },
  cell: { flex: 1 },
  kpiGrid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpiBox: { flex: 1, padding: 8, backgroundColor: "#f5f5f7", borderRadius: 4 },
  kpiLabel: { fontSize: 8, color: "#666" },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  disclaimer: { fontSize: 8, color: "#999", marginTop: 24, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 8 },
});

type Analytics = Awaited<ReturnType<typeof import("@/lib/analytics/stats").getCollegeAnalytics>>;

export function PlacementSummaryPdf({ collegeName, generatedAt, a }: { collegeName: string; generatedAt: string; a: Analytics }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Placement Summary Report</Text>
        <Text style={styles.subtitle}>{collegeName} · Generated {generatedAt}</Text>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Placement %</Text><Text style={styles.kpiValue}>{a.placementPct.toFixed(1)}%</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Students Placed</Text><Text style={styles.kpiValue}>{a.placedCount} / {a.studentCount}</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Total Offers</Text><Text style={styles.kpiValue}>{a.offerCount}</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Companies</Text><Text style={styles.kpiValue}>{a.companiesWithOffers}</Text></View>
        </View>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Highest Package</Text><Text style={styles.kpiValue}>Rs. {(a.highest / 100000).toFixed(1)}L</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Average Package</Text><Text style={styles.kpiValue}>Rs. {(a.average / 100000).toFixed(1)}L</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Median Package</Text><Text style={styles.kpiValue}>Rs. {(a.median / 100000).toFixed(1)}L</Text></View>
          <View style={styles.kpiBox}><Text style={styles.kpiLabel}>Drives Run</Text><Text style={styles.kpiValue}>{a.driveCount}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Department-wise placement</Text>
        <View style={styles.headerRow}>
          <Text style={styles.cell}>Department</Text><Text style={styles.cell}>Total</Text><Text style={styles.cell}>Placed</Text><Text style={styles.cell}>%</Text>
        </View>
        {a.departmentRows.map((r) => (
          <View key={r.name} style={styles.row}>
            <Text style={styles.cell}>{r.name}</Text><Text style={styles.cell}>{r.total}</Text><Text style={styles.cell}>{r.placed}</Text><Text style={styles.cell}>{r.pct.toFixed(1)}%</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Course-wise placement</Text>
        <View style={styles.headerRow}>
          <Text style={styles.cell}>Course</Text><Text style={styles.cell}>Total</Text><Text style={styles.cell}>Placed</Text><Text style={styles.cell}>%</Text><Text style={styles.cell}>Avg Package</Text>
        </View>
        {a.courseRows.map((r) => (
          <View key={r.name} style={styles.row}>
            <Text style={styles.cell}>{r.name}</Text><Text style={styles.cell}>{r.total}</Text><Text style={styles.cell}>{r.placed}</Text>
            <Text style={styles.cell}>{r.pct.toFixed(1)}%</Text><Text style={styles.cell}>Rs. {(r.avgPackage / 100000).toFixed(1)}L</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Recruiting companies</Text>
        <View style={styles.headerRow}>
          <Text style={styles.cell}>Company</Text><Text style={styles.cell}>Drives</Text><Text style={styles.cell}>Offers</Text><Text style={styles.cell}>Avg Package</Text>
        </View>
        {a.companyRows.slice(0, 20).map((r) => (
          <View key={r.name} style={styles.row}>
            <Text style={styles.cell}>{r.name}</Text><Text style={styles.cell}>{r.drives}</Text><Text style={styles.cell}>{r.offers}</Text><Text style={styles.cell}>Rs. {(r.avgPackage / 100000).toFixed(1)}L</Text>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          This report reflects live data from {PWA_CONFIG.name} at the time of generation. It is not a certified NIRF/NAAC (or any other accreditation
          body) submission format — verify against the current official template before using it for an accreditation filing.
        </Text>
      </Page>
    </Document>
  );
}
