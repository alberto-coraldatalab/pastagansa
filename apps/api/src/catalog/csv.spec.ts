import { BadRequestException } from '@nestjs/common';
import { parseCatalogCsv } from './csv';

describe('parseCatalogCsv', () => {
  const header = 'type,sku,name,description,unit,sales_price,currency,suggested_tax_code,revenue_account_code,expense_account_code,track_inventory';

  it('parses a product with commercial defaults', () => {
    const rows = parseCatalogCsv(`${header}\nPRODUCT,SKU-1,"Pasta, 500g",,kg,3.50,EUR,VAT_21,700,600,yes`);
    expect(rows[0]).toMatchObject({ type: 'PRODUCT', sku: 'SKU-1', name: 'Pasta, 500g', salesPrice: '3.50', trackInventory: true });
  });

  it('rejects inventory tracking for services', () => {
    expect(() => parseCatalogCsv(`${header}\nSERVICE,S-1,Consulting,,hour,100,EUR,,,,true`)).toThrow(BadRequestException);
  });
});
