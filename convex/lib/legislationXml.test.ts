import { expect, test } from 'vitest';
import { parseSectionXml } from './legislationXml';

const xml = `<Legislation><ukm:Metadata><dct:valid>2026-10-30</dct:valid></ukm:Metadata><Primary><Body><P1group><Title> Employees, workers <Abbreviation>etc.</Abbreviation></Title><P1 id="section-230"><Pnumber>230</Pnumber><P1para><P2><Pnumber>1</Pnumber><P2para><Text>In this Act &#x201C;<Term>employee</Term>&#x201D; means an individual.</Text></P2para></P2></P1para></P1></P1group></Body></Primary></Legislation>`;

test('parses a CLML section', () => {
  expect(parseSectionXml(xml)).toEqual({
    heading: 'Employees, workers etc',
    text: '(1) In this Act “employee” means an individual.',
    inForce: true,
    versionDate: '2026-10-30',
  });
  expect(parseSectionXml(xml.replace(/Body>/g, 'EUBody>').replace('<Body>', '<EUBody>'))?.heading).toBe('Employees, workers etc');
});
