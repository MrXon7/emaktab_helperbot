import io
import uuid
import openpyxl

class ExcelParser:
    @staticmethod
    def parse_excel_bytes(file_bytes: bytes) -> list[dict]:
        """
        Excel baytlarini o'qib, o'quvchilar ro'yxatini qaytaradi.
        Ustunlar tartibi:
        A -> Ism (F.I.Sh)
        B -> Maktab nomi
        C -> Sinf
        D -> Login
        E -> Parol
        """
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = workbook.active
        
        students = []
        rows = list(sheet.iter_rows(values_only=True))
        
        if not rows:
            return []

        # 1-qator header bo'lsa o'tkazib yuboramiz
        start_idx = 1 if len(rows) > 1 and any("ism" in str(cell).lower() or "login" in str(cell).lower() or "name" in str(cell).lower() for cell in rows[0] if cell) else 0

        for row in rows[start_idx:]:
            if not row or len(row) < 2:
                continue

            name = str(row[0]).strip() if row[0] is not None else ""
            school = str(row[1]).strip() if len(row) > 1 and row[1] is not None else "Maktab"
            grade = str(row[2]).strip() if len(row) > 2 and row[2] is not None else "1-A"
            login = str(row[3]).strip() if len(row) > 3 and row[3] is not None else ""
            password = str(row[4]).strip() if len(row) > 4 and row[4] is not None else ""

            # Agar login boshqa ustunda kelsa
            if not login and len(row) >= 2:
                # Agar 2 ta ustun bo'lsa: [Name, Login] yoki [Login, Password]
                login = str(row[1]).strip() if row[1] is not None else ""
                password = str(row[2]).strip() if len(row) > 2 and row[2] is not None else "12345"

            if name and login:
                students.append({
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "schoolName": school if school else "Maktab",
                    "grade": grade if grade else "Sinf",
                    "login": login,
                    "password": password,
                    "status": "pending",
                    "message": ""
                })

        return students
