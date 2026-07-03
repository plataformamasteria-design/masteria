import 'dotenv/config';
import { generateOrUpdateCurrentMonthInvoices } from '../src/app/actions/financial-invoices-actions.js';

async function test() {
    try {
        const res = await generateOrUpdateCurrentMonthInvoices();
        console.log(res);
    } catch(err) {
        console.error(err);
    }
}
test();
