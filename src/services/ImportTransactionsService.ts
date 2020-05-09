import csvParse from 'csv-parse';
import { getRepository, getCustomRepository, In } from 'typeorm';
import fs from 'fs';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const contactsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2,
    });

    const parseCSV = contactsReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });
    await new Promise(resolve => parseCSV.on('end', resolve));
    // verifica quais categorias do CSV já existem no banco de dados
    const categoriesExists = await categoriesRepository.find({
      where: { title: In(categories) },
    });
    // recuperar só os titulos
    const categoriesExistsTitle = categoriesExists.map(
      (category: Category) => category.title,
    );
    // verifica as categorias que não existem no banco e remove as duplicadas
    const categoriesToAdd = categories
      .filter(category => !categoriesExistsTitle.includes(category))
      .filter((title, index, category) => category.indexOf(title) === index);

    // salvar categorias no banco
    const importCategories = categoriesRepository.create(
      categoriesToAdd.map(title => ({ title })),
    );

    await categoriesRepository.save(importCategories);

    const allCategories = [...importCategories, ...categoriesExists];

    // Save transactions to bd

    const importTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(importTransactions);
    // delete to CSV
    await fs.promises.unlink(filePath);
    console.log(importTransactions);
    return importTransactions;
  }
}

export default ImportTransactionsService;
