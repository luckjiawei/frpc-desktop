import BaseDao from "../dao/BaseDao";

interface BaseServiceInterface<T> {
  dao: BaseDao<T>;
}

class BaseService<T> implements BaseServiceInterface<T> {
  dao: BaseDao<T>;

  constructor(dao: BaseDao<T>) {
    this.dao = dao;
  }
}

export default BaseService;
