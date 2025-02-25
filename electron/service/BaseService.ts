import BaseRepository from "../repository/BaseRepository";


interface BaseServiceInterface<T> {
  // dao: BaseRepository<T>;
}

class BaseService<T> implements BaseServiceInterface<T> {
  // dao: BaseRepository<T>;
  //
  // constructor(dao: BaseRepository<T>) {
  //   this.dao = dao;
  // }
}

export default BaseService;
