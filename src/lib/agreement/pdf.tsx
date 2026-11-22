import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

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

/** All text in the language of the person who asked for the PDF. Built by the route from the `pdf` and `agreement` messages. */
export interface AgreementPdfLabels {
  title: string;
  version: string;
  demoNote: string;
  project: string;
  owners: string;
  notListed: string;
  team: string;
  members: string;
  tasks: string;
  terms: string;
  acceptedBy: string;
  credit: string;
  lineageRef: string;
  disclaimer: string;
  termTexts: string[];
}

export interface AgreementPdfData {
  projectTitle: string;
  owners: string[];
  adopterTeam: string;
  adopters: string[];
  tasks: string[];
  /** Each person who accepted the agreement for themselves. Acceptance is per person. */
  accepted: { name: string; at: string }[];
  lineageId: string;
  creditLine: string;
  isDemo: boolean;
  labels: AgreementPdfLabels;
}

export function AgreementDocument({ data }: { data: AgreementPdfData }) {
  const l = data.labels;
  return (
    <Document title={`${l.title}: ${data.projectTitle}`} author="ESTAFET">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>ESTAFET</Text>
        <Text style={s.h1}>{l.title}</Text>
        <Text style={s.sub}>
          {l.version}
          {data.isDemo ? l.demoNote : ""}
        </Text>

        <View style={s.row}>
          <Text style={s.label}>{l.project}</Text>
          <Text>{data.projectTitle}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{l.owners}</Text>
          <Text>{data.owners.join(", ") || l.notListed}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{l.team}</Text>
          <Text>{data.adopterTeam}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{l.members}</Text>
          <Text>{data.adopters.join(", ")}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>{l.tasks}</Text>
          <Text style={{ flex: 1 }}>{data.tasks.join("; ")}</Text>
        </View>

        <Text style={s.h2}>{l.terms}</Text>
        {l.termTexts.map((t, i) => (
          <Text key={i} style={s.term}>
            {i + 1}. {t}
          </Text>
        ))}

        <Text style={s.h2}>{l.acceptedBy}</Text>
        {data.accepted.map((a, i) => (
          <Text key={"a" + i}>
            {a.name} · {a.at}
          </Text>
        ))}

        <Text style={s.h2}>{l.credit}</Text>
        <Text style={s.box}>{data.creditLine}</Text>
        <Text style={s.note}>{l.lineageRef}</Text>
        <Text style={s.note}>{l.disclaimer}</Text>
      </Page>
    </Document>
  );
}
