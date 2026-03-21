import zipfile
import xml.etree.ElementTree as ET
import sys

def read_xlsx_headers(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                xml_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(xml_content)
                for elem in root.iter():
                    if elem.tag.endswith('}t'):
                        shared_strings.append(elem.text)
            
            sheet_content = None
            for name in z.namelist():
                if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
                    sheet_content = z.read(name)
                    break
                    
            if not sheet_content:
                print("No sheet found")
                return
                
            root = ET.fromstring(sheet_content)
            
            rows = []
            for row in root.iter():
                if row.tag.endswith('}row'):
                    cells = []
                    for c in row.findall('.//'):
                        if c.tag.endswith('}c'):
                            val = ""
                            v_elem = None
                            for child in c:
                                if child.tag.endswith('}v') or child.tag.endswith('}t'):
                                    v_elem = child
                            if v_elem is not None and v_elem.text is not None:
                                if c.get('t') == 's':
                                    try:
                                        val = shared_strings[int(v_elem.text)]
                                    except:
                                        val = v_elem.text
                                elif c.get('t') == 'inlineStr':
                                    for t_elem in c.iter():
                                        if t_elem.tag.endswith('}t'):
                                            val = t_elem.text
                                else:
                                    val = v_elem.text
                            cells.append(val)
                    if any(cells): # Only add non-empty rows
                        rows.append(cells)
                    if len(rows) >= 3:
                        break
                        
            for r in rows:
                print(r)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    read_xlsx_headers(sys.argv[1])
