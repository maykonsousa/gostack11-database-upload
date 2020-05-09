import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface ReqDTO {
  title: string;
  value: number;
  category: string;
  type: 'income' | 'outcome';
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    category,
    type,
  }: ReqDTO): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    // verificar se a despesa é maior que o saldo
    const { total } = await transactionsRepository.getBalance();
    if (type === 'outcome' && total < value) {
      throw new AppError('insufficient funds');
    }

    // verificar se a categoria existe
    let addCategory = await categoryRepository.findOne({
      where: { title: category },
    });
    // se não existir, criar categoria
    if (!addCategory) {
      addCategory = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(addCategory);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: addCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
