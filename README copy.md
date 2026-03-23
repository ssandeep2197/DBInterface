mysqldb-interface 

# Import the package
 const dbInterface=require("mysqldb-interface")

# Run the mysqldb server by invoking start method
  
  require("mysqldb-interface").start()
  or                                     // default it takes 8000 port 
  dbInterface.start() 

  
  require("mysqldb-interface").start(8001)
  or                                    // specified port to listen
  dbInterface.start(8001) 