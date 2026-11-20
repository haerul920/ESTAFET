import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { AGREEMENT_DISCLAIMER, AGREEMENT_TERMS, AGREEMENT_VERSION } from "./terms";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#0E1A26", lineHeight: 1.5 },
  brand: { fontSize: 10, letterSpacing: 2, color: "#1760D6", marginBottom: 6 },
  h1: { fontSize: 22, marginBottom: 4 },
  sub: { color: "#4A5A66", marginBottom: 20 },
  h2: { fontSize: 13, marginTop: 18, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 130, color: "#4A5A66" },
  term: { marginBottom: 6, paddingLeft: 10 },
  box: { marginTop: 8, padding: 10, backgroundColor: "#F3F4F6", fontSize: 10 },
  note: { marginTop: 24, fontSize: 9, color: "#4A5A66" },
});

export interface AgreementPdfData {
  projectTitle: string;
  creators: string[];
  advisor: string;
  adopterTeam: string;
  adopters: string[];
  tasks: string[];
  creatorAccepted: { name: string; at: string }[];
  adopterAccepted: { name: string; at: string }[];
  lineageId: string;
  creditLine: string;
  isDemo: boolean;
}

export function AgreementDocument({ data }: { data: AgreementPdfData }) {
  return (
    <Document title={`Attribution agreement: ${data.projectTitle}`} author="ESTAFET">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>ESTAFET</Text>
        <Text style={s.h1}>Attribution agreement</Text>
        <Text style={s.sub}>
          Version {AGREEMENT_VERSION}
          {data.isDemo ? " · Demo data, not a real handover" : ""}
        </Text>

        <View style={s.row}>
          <Text style={s.label}>Project</Text>
          <Text>{data.projectTitle}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Original creators</Text>
          <Text>{data.creators.join(", ") || "Not listed"}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Advisor</Text>
          <Text>{data.advisor || "Not listed"}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Adopter team</Text>
          <Text>{data.adopterTeam}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Adopters</Text>
          <Text>{data.adopters.join(", ")}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Tasks taken on</Text>
          <Text style={{ flex: 1 }}>{data.tasks.join("; ")}</Text>
        </View>

        <Text style={s.h2}>Terms</Text>
        {AGREEMENT_TERMS.map((t, i) => (
          <Text key={i} style={s.term}>
            {i + 1}. {t}
          </Text>
        ))}

        <Text style={s.h2}>Accepted by</Text>
        {data.creatorAccepted.map((a, i) => (
          <Text key={"c" + i}>
            Creator: {a.name} · {a.at}
          </Text>
        ))}
        {data.adopterAccepted.map((a, i) => (
          <Text key={"a" + i}>
            Adopter: {a.name} · {a.at}
          </Text>
        ))}

        <Text style={s.h2}>Credit line for future submissions</Text>
        <Text style={s.box}>{data.creditLine}</Text>
        <Text style={s.note}>Lineage reference: {data.lineageId}</Text>
        <Text style={s.note}>{AGREEMENT_DISCLAIMER}</Text>
      </Page>
    </Document>
  );
}
